#include "framebuffer.h"
#include "protocol.h"

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <string.h>

LOG_MODULE_REGISTER(framebuffer, CONFIG_LOG_DEFAULT_LEVEL);

#define MAX_FB_SIZE 10000

static uint8_t fb_buffer[MAX_FB_SIZE];
static uint16_t fb_width;
static uint16_t fb_height;
static uint8_t fb_format;
static uint32_t fb_expected_size;
static uint32_t fb_expected_crc;
static uint16_t fb_chunk_size;
static uint32_t fb_received;
static bool fb_active;

static uint32_t compute_crc32(const uint8_t *data, uint32_t len)
{
    uint32_t crc = 0xFFFFFFFF;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            if (crc & 1)
                crc = (crc >> 1) ^ 0xEDB88320;
            else
                crc >>= 1;
        }
    }
    return crc ^ 0xFFFFFFFF;
}

int fb_begin_frame(uint16_t width, uint16_t height, uint8_t format,
                   uint32_t frame_size, uint32_t crc32, uint16_t chunk_size)
{
    if (frame_size > MAX_FB_SIZE) {
        LOG_ERR("Frame too large: %u > %u", frame_size, MAX_FB_SIZE);
        return -1;
    }

    fb_width = width;
    fb_height = height;
    fb_format = format;
    fb_expected_size = frame_size;
    fb_expected_crc = crc32;
    fb_chunk_size = chunk_size;
    fb_received = 0;
    fb_active = true;

    memset(fb_buffer, 0, sizeof(fb_buffer));

    LOG_INF("Frame buffer ready: %ux%u fmt=%u size=%u",
            width, height, format, frame_size);
    return 0;
}

int fb_write_chunk(uint16_t seq, const uint8_t *data, uint16_t len)
{
    if (!fb_active) {
        return -1;
    }

    uint32_t offset = (uint32_t)seq * fb_chunk_size;
    if (offset + len > MAX_FB_SIZE) {
        LOG_ERR("Chunk overflow at seq=%u offset=%u len=%u", seq, offset, len);
        return -1;
    }

    memcpy(&fb_buffer[offset], data, len);
    fb_received += len;

    return 0;
}

int fb_end_frame(void)
{
    if (!fb_active) {
        return -2;
    }

    fb_active = false;

    if (fb_received != fb_expected_size) {
        LOG_ERR("Size mismatch: received=%u expected=%u", fb_received, fb_expected_size);
        return -2;
    }

    uint32_t crc = compute_crc32(fb_buffer, fb_received);
    if (crc != fb_expected_crc) {
        LOG_ERR("CRC mismatch: computed=0x%08X expected=0x%08X", crc, fb_expected_crc);
        return -1;
    }

    LOG_INF("Frame verified OK (size=%u, crc=0x%08X)", fb_received, crc);
    return 0;
}

void fb_abort(void)
{
    fb_active = false;
    fb_received = 0;
    LOG_INF("Frame aborted");
}

const uint8_t *fb_get_black_plane(void)
{
    return fb_buffer;
}

const uint8_t *fb_get_red_plane(void)
{
    if (fb_format == FORMAT_2PLANE) {
        uint16_t row_bytes = (fb_width + 7) / 8;
        uint32_t plane_size = row_bytes * fb_height;
        if (plane_size < fb_expected_size) {
            return &fb_buffer[plane_size];
        }
    }
    return NULL;
}

uint16_t fb_get_width(void)
{
    return fb_width;
}

uint16_t fb_get_height(void)
{
    return fb_height;
}

uint8_t fb_get_format(void)
{
    return fb_format;
}