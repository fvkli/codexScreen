#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

#include "ble_service.h"
#include "epaper.h"
#include "power.h"

LOG_MODULE_REGISTER(main, CONFIG_LOG_DEFAULT_LEVEL);

#define BLE_DEVICE_NAME "CodexQuota"
#define BLE_DEVICE_NAME_LEN (sizeof(BLE_DEVICE_NAME) - 1)

static const struct bt_data ad[] = {
    BT_DATA(BT_DATA_NAME_COMPLETE, BLE_DEVICE_NAME, BLE_DEVICE_NAME_LEN),
};

int main(void)
{
    LOG_INF("Codex Epaper Quota Display starting...");

    power_init();

    int err = epaper_init();
    if (err) {
        LOG_ERR("Epaper init failed: %d", err);
        return err;
    }
    LOG_INF("Epaper initialized");

    err = ble_service_init();
    if (err) {
        LOG_ERR("BLE service init failed: %d", err);
        return err;
    }
    LOG_INF("BLE service initialized");

    err = bt_le_adv_start(BT_LE_ADV_CONN, ad, ARRAY_SIZE(ad), NULL, 0);
    if (err) {
        LOG_ERR("Advertising failed: %d", err);
        return err;
    }
    LOG_INF("Advertising as '%s'", BLE_DEVICE_NAME);

    while (1) {
        if (ble_service_get_state() == 4) {
            LOG_INF("Display updated, entering idle");
            epaper_sleep();
            k_sleep(K_SECONDS(30));
            epaper_init();
        }
        k_sleep(K_SECONDS(1));
    }

    return 0;
}