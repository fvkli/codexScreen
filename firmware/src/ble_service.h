#ifndef BLE_SERVICE_H_
#define BLE_SERVICE_H_

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/bluetooth/conn.h>

int ble_service_init(void);
void ble_service_notify_status(void);
void ble_service_set_state(uint8_t state);
void ble_service_set_error(uint8_t error);
void ble_service_increment_chunks(void);
void ble_service_set_expected_chunks(uint16_t expected);
uint8_t ble_service_get_state(void);

extern struct bt_conn *current_conn;

#endif /* BLE_SERVICE_H_ */