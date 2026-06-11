#include "epaper_driver_ssd1680.h"

#include <zephyr/kernel.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/logging/log.h>
#include <string.h>

LOG_MODULE_REGISTER(ssd1680, CONFIG_LOG_DEFAULT_LEVEL);

#define EPAPER_WIDTH  250
#define EPAPER_HEIGHT 122

static const struct spi_dt_spec spi_spec = SPI_DT_SPEC_GET(DT_NODELABEL(epaper), SPI_OP_MODE_MASTER | SPI_TRANSFER_MSB | SPI_WORD_SET(8), 0);
static const struct gpio_dt_spec dc_pin  = GPIO_DT_SPEC_GET(DT_NODELABEL(epaper), dc_gpios);
static const struct gpio_dt_spec rst_pin = GPIO_DT_SPEC_GET(DT_NODELABEL(epaper), reset_gpios);
static const struct gpio_dt_spec busy_pin = GPIO_DT_SPEC_GET(DT_NODELABEL(epaper), busy_gpios);
static const struct gpio_dt_spec cs_pin  = GPIO_DT_SPEC_GET(DT_NODELABEL(epaper), cs_gpios);

static void wait_busy(void)
{
    while (gpio_pin_get_dt(&busy_pin) == 1) {
        k_msleep(10);
    }
}

static void send_command(uint8_t cmd)
{
    gpio_pin_set_dt(&dc_pin, 0);
    gpio_pin_set_dt(&cs_pin, 0);

    struct spi_buf buf = { .buf = &cmd, .len = 1 };
    struct spi_buf_set set = { .buffers = &buf, .count = 1 };
    spi_write_dt(&spi_spec, &set);

    gpio_pin_set_dt(&cs_pin, 1);
}

static void send_data(const uint8_t *data, uint16_t len)
{
    gpio_pin_set_dt(&dc_pin, 1);
    gpio_pin_set_dt(&cs_pin, 0);

    struct spi_buf buf = { .buf = (void *)data, .len = len };
    struct spi_buf_set set = { .buffers = &buf, .count = 1 };
    spi_write_dt(&spi_spec, &set);

    gpio_pin_set_dt(&cs_pin, 1);
}

static void reset_hw(void)
{
    gpio_pin_set_dt(&rst_pin, 1);
    k_msleep(20);
    gpio_pin_set_dt(&rst_pin, 0);
    k_msleep(20);
    gpio_pin_set_dt(&rst_pin, 1);
    k_msleep(20);
    wait_busy();
}

/* TODO: verify LUT/init sequence with the actual panel datasheet. */
static void load_lut_full(void)
{
    send_command(0x32);
    static const uint8_t lut_full[] = {
        0x02, 0x02, 0x01, 0x11, 0x01, 0x02, 0x01, 0x02,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    };
    send_data(lut_full, sizeof(lut_full));
}

static void set_display_window(uint16_t x, uint16_t y, uint16_t w, uint16_t h)
{
    send_command(0x44);
    uint8_t buf[4] = { x / 8, (x + w - 1) / 8, x / 8, (x + w - 1) / 8 };
    send_data(buf, 4);

    send_command(0x45);
    buf[0] = y; buf[1] = 0; buf[2] = y + h - 1; buf[3] = 0;
    send_data(buf, 4);
}

static void write_image(const uint8_t *data, uint16_t w, uint16_t h)
{
    uint16_t row_bytes = (w + 7) / 8;
    uint32_t total = row_bytes * h;

    send_command(0x4E);
    uint8_t tmp = 0;
    send_data(&tmp, 1);

    send_command(0x4F);
    tmp = 0;
    send_data(&tmp, 1);

    send_command(0x24);
    send_data(data, total);
}

static void write_red_image(const uint8_t *data, uint16_t w, uint16_t h)
{
    uint16_t row_bytes = (w + 7) / 8;
    uint32_t total = row_bytes * h;

    send_command(0x4E);
    uint8_t tmp = 0;
    send_data(&tmp, 1);

    send_command(0x4F);
    tmp = 0;
    send_data(&tmp, 1);

    send_command(0x26);
    send_data(data, total);
}

int ssd1680_init(void)
{
    if (!spi_is_ready_dt(&spi_spec)) {
        LOG_ERR("SPI not ready");
        return -1;
    }
    if (!gpio_is_ready_dt(&dc_pin) || !gpio_is_ready_dt(&rst_pin) ||
        !gpio_is_ready_dt(&busy_pin) || !gpio_is_ready_dt(&cs_pin)) {
        LOG_ERR("GPIO not ready");
        return -1;
    }

    gpio_pin_configure_dt(&dc_pin, GPIO_OUTPUT_ACTIVE);
    gpio_pin_configure_dt(&rst_pin, GPIO_OUTPUT_ACTIVE);
    gpio_pin_configure_dt(&busy_pin, GPIO_INPUT);
    gpio_pin_configure_dt(&cs_pin, GPIO_OUTPUT_ACTIVE);

    reset_hw();

    send_command(0x12);
    wait_busy();

    LOG_INF("SSD1680 initialized");
    return 0;
}

int ssd1680_sleep(void)
{
    send_command(0x10);
    uint8_t data = 0x01;
    send_data(&data, 1);
    LOG_INF("SSD1680 deep sleep");
    return 0;
}

int ssd1680_clear(void)
{
    reset_hw();

    send_command(0x12);
    wait_busy();

    LOG_INF("SSD1680 cleared");
    return 0;
}

int ssd1680_refresh_bw(const uint8_t *black)
{
    reset_hw();

    set_display_window(0, 0, EPAPER_WIDTH, EPAPER_HEIGHT);
    write_image(black, EPAPER_WIDTH, EPAPER_HEIGHT);

    load_lut_full();

    send_command(0x22);
    uint8_t data = 0xC4;
    send_data(&data, 1);
    send_command(0x20);
    wait_busy();

    send_command(0x12);
    wait_busy();

    LOG_INF("BW refresh done");
    return 0;
}

int ssd1680_refresh_bwr(const uint8_t *black, const uint8_t *red)
{
    reset_hw();

    set_display_window(0, 0, EPAPER_WIDTH, EPAPER_HEIGHT);
    write_image(black, EPAPER_WIDTH, EPAPER_HEIGHT);
    write_red_image(red, EPAPER_WIDTH, EPAPER_HEIGHT);

    load_lut_full();

    send_command(0x22);
    uint8_t data = 0xC7;
    send_data(&data, 1);
    send_command(0x20);
    wait_busy();

    send_command(0x12);
    wait_busy();

    LOG_INF("BWR refresh done");
    return 0;
}