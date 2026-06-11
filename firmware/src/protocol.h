#ifndef PROTOCOL_H_
#define PROTOCOL_H_

#include <stdint.h>

#define SERVICE_UUID "7b7d0001-8c5f-4e87-9f8e-codexquota01"
#define CHAR_CONTROL_UUID "7b7d0002-8c5f-4e87-9f8e-codexquota01"
#define CHAR_DATA_UUID "7b7d0003-8c5f-4e87-9f8e-codexquota01"
#define CHAR_STATUS_UUID "7b7d0004-8c5f-4e87-9f8e-codexquota01"

#define CMD_BEGIN_FRAME 0x01
#define CMD_END_FRAME   0x02
#define CMD_REFRESH     0x03
#define CMD_ABORT       0x04
#define CMD_PING        0x05

#define FORMAT_1BPP    1
#define FORMAT_2PLANE  2

#define STATE_IDLE       0
#define STATE_RECEIVING  1
#define STATE_VERIFYING  2
#define STATE_REFRESHING 3
#define STATE_DONE       4
#define STATE_ERROR      5

#define ERROR_NONE        0
#define ERROR_CRC         1
#define ERROR_SIZE        2
#define ERROR_OVERFLOW    3
#define ERROR_SEQUENCE   4

struct begin_frame_payload {
    uint16_t width;
    uint16_t height;
    uint8_t  format;
    uint32_t frame_size;
    uint32_t crc32;
    uint16_t chunk_size;
};

struct data_chunk_header {
    uint16_t seq;
    uint16_t payload_len;
};

struct status_notify {
    uint8_t  state;
    uint16_t received_chunks;
    uint16_t expected_chunks;
    uint8_t  battery_percent;
    uint8_t  error_code;
};

#endif /* PROTOCOL_H_ */