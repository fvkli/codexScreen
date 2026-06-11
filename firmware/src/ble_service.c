#include "ble_service.h"
#include "protocol.h"
#include "framebuffer.h"

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(ble_service, CONFIG_LOG_DEFAULT_LEVEL);

static struct status_notify status = {
    .state = STATE_IDLE,
    .received_chunks = 0,
    .expected_chunks = 0,
    .battery_percent = 100,
    .error_code = ERROR_NONE,
};

struct bt_conn *current_conn;

static ssize_t on_control_write(struct bt_conn *conn,
                                const struct bt_gatt_attr *attr,
                                const void *buf, uint16_t len,
                                uint16_t offset, uint8_t flags);

static ssize_t on_data_write(struct bt_conn *conn,
                             const struct bt_gatt_attr *attr,
                             const void *buf, uint16_t len,
                             uint16_t offset, uint8_t flags);

BT_GATT_SERVICE_DEFINE(codex_svc,
    BT_GATT_PRIMARY_SERVICE(BT_UUID_DECLARE_128(
        0x01, 0x30, 0x61, 0x75, 0x71, 0x65, 0x78, 0x6f,
        0x64, 0x63, 0x2d, 0x65, 0x78, 0x6f, 0x63, 0x2d)),

    BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(
        0x02, 0x30, 0x61, 0x75, 0x71, 0x65, 0x78, 0x6f,
        0x64, 0x63, 0x2d, 0x65, 0x78, 0x6f, 0x63, 0x2d),
        BT_GATT_CHRC_WRITE,
        BT_GATT_PERM_WRITE,
        NULL, on_control_write, NULL),

    BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(
        0x03, 0x30, 0x61, 0x75, 0x71, 0x65, 0x78, 0x6f,
        0x64, 0x63, 0x2d, 0x65, 0x78, 0x6f, 0x63, 0x2d),
        BT_GATT_CHRC_WRITE_WITHOUT_RESP,
        BT_GATT_PERM_WRITE,
        NULL, on_data_write, NULL),

    BT_GATT_CHARACTERISTIC(BT_UUID_DECLARE_128(
        0x04, 0x30, 0x61, 0x75, 0x71, 0x65, 0x78, 0x6f,
        0x64, 0x63, 0x2d, 0x65, 0x78, 0x6f, 0x63, 0x2d),
        BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_NONE,
        NULL, NULL, NULL),

    BT_GATT_CCC(NULL, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
);

static const struct bt_gatt_attr *status_attr = &codex_svc.attrs[4];

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    current_conn = bt_conn_ref(conn);
    LOG_INF("Device connected");
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    if (current_conn) {
        bt_conn_unref(current_conn);
        current_conn = NULL;
    }
    LOG_INF("Device disconnected (reason %u)", reason);
}

BT_CONN_CB_DEFINE(conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
};

static void mtu_exchange_cb(struct bt_conn *conn, uint8_t err,
                            struct bt_gatt_exchange_params *params)
{
    if (err) {
        LOG_WRN("MTU exchange failed (err %u)", err);
    } else {
        LOG_INF("MTU exchanged: %u", bt_conn_get_mtu(conn));
    }
}

static struct bt_gatt_exchange_params mtu_params = {
    .func = mtu_exchange_cb,
};

static ssize_t on_control_write(struct bt_conn *conn,
                                const struct bt_gatt_attr *attr,
                                const void *buf, uint16_t len,
                                uint16_t offset, uint8_t flags)
{
    const uint8_t *data = (const uint8_t *)buf;

    if (len < 1) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
    }

    uint8_t cmd = data[0];

    switch (cmd) {
    case CMD_BEGIN_FRAME: {
        if (len < 16) {
            return BT_GATT_ERR(BT_ATT_ERR_INVALID_ATTRIBUTE_LEN);
        }
        struct begin_frame_payload payload;
        payload.width = sys_get_be16(&data[1]);
        payload.height = sys_get_be16(&data[3]);
        payload.format = data[5];
        payload.frame_size = sys_get_be32(&data[6]);
        payload.crc32 = sys_get_be32(&data[10]);
        payload.chunk_size = sys_get_be16(&data[14]);

        LOG_INF("BEGIN_FRAME: %ux%u fmt=%u size=%u crc=0x%08X chunk=%u",
                payload.width, payload.height, payload.format,
                payload.frame_size, payload.crc32, payload.chunk_size);

        int ret = fb_begin_frame(payload.width, payload.height,
                                 payload.format, payload.frame_size,
                                 payload.crc32, payload.chunk_size);
        if (ret == 0) {
            status.state = STATE_RECEIVING;
            status.received_chunks = 0;
            status.expected_chunks = (payload.frame_size + payload.chunk_size - 1) / payload.chunk_size;
            status.error_code = ERROR_NONE;
        } else {
            status.state = STATE_ERROR;
            status.error_code = ERROR_OVERFLOW;
        }
        ble_service_notify_status();
        break;
    }
    case CMD_END_FRAME: {
        LOG_INF("END_FRAME received");
        status.state = STATE_VERIFYING;
        ble_service_notify_status();

        int ret = fb_end_frame();
        if (ret == 0) {
            status.state = STATE_DONE;
            status.error_code = ERROR_NONE;
        } else {
            status.state = STATE_ERROR;
            status.error_code = (ret == -1) ? ERROR_CRC : ERROR_SIZE;
        }
        ble_service_notify_status();
        break;
    }
    case CMD_REFRESH: {
        LOG_INF("REFRESH command");
        status.state = STATE_REFRESHING;
        ble_service_notify_status();

        extern int epaper_refresh_from_fb(void);
        epaper_refresh_from_fb();

        status.state = STATE_DONE;
        ble_service_notify_status();
        break;
    }
    case CMD_ABORT: {
        LOG_INF("ABORT command");
        fb_abort();
        status.state = STATE_IDLE;
        status.received_chunks = 0;
        status.error_code = ERROR_NONE;
        ble_service_notify_status();
        break;
    }
    case CMD_PING: {
        LOG_INF("PING command");
        ble_service_notify_status();
        break;
    }
    default:
        LOG_WRN("Unknown command: 0x%02X", cmd);
        break;
    }

    return len;
}

static ssize_t on_data_write(struct bt_conn *conn,
                             const struct bt_gatt_attr *attr,
                             const void *buf, uint16_t len,
                             uint16_t offset, uint8_t flags)
{
    if (status.state != STATE_RECEIVING) {
        return len;
    }

    const uint8_t *data = (const uint8_t *)buf;
    if (len < 4) {
        return len;
    }

    struct data_chunk_header hdr;
    hdr.seq = sys_get_be16(&data[0]);
    hdr.payload_len = sys_get_be16(&data[2]);

    if (len < 4 + hdr.payload_len) {
        return len;
    }

    fb_write_chunk(hdr.seq, &data[4], hdr.payload_len);
    status.received_chunks++;

    if (status.received_chunks % 20 == 0) {
        ble_service_notify_status();
    }

    return len;
}

int ble_service_init(void)
{
    int err = bt_enable(NULL);
    if (err) {
        LOG_ERR("Bluetooth init failed (err %d)", err);
        return err;
    }
    LOG_INF("Bluetooth initialized");

    if (current_conn) {
        bt_gatt_exchange_mtu(current_conn, &mtu_params);
    }

    return 0;
}

void ble_service_notify_status(void)
{
    if (!current_conn) {
        return;
    }

    uint8_t buf[8];
    buf[0] = status.state;
    sys_put_be16(status.received_chunks, &buf[1]);
    sys_put_be16(status.expected_chunks, &buf[3]);
    buf[5] = status.battery_percent;
    buf[6] = status.error_code;
    buf[7] = 0;

    bt_gatt_notify(current_conn, status_attr, buf, sizeof(buf));
}

void ble_service_set_state(uint8_t state)
{
    status.state = state;
}

void ble_service_set_error(uint8_t error)
{
    status.error_code = error;
}

void ble_service_increment_chunks(void)
{
    status.received_chunks++;
}

void ble_service_set_expected_chunks(uint16_t expected)
{
    status.expected_chunks = expected;
}

uint8_t ble_service_get_state(void)
{
    return status.state;
}