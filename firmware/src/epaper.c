#include "epaper.h"
#include "epaper_driver_ssd1680.h"
#include "framebuffer.h"
#include "protocol.h"

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(epaper, CONFIG_LOG_DEFAULT_LEVEL);

int epaper_init(void)
{
    return ssd1680_init();
}

int epaper_sleep(void)
{
    return ssd1680_sleep();
}

int epaper_clear(void)
{
    return ssd1680_clear();
}

int epaper_refresh_bw(const uint8_t *black)
{
    int ret = ssd1680_refresh_bw(black);
    return ret;
}

int epaper_refresh_bwr(const uint8_t *black, const uint8_t *red)
{
    int ret = ssd1680_refresh_bwr(black, red);
    return ret;
}

int epaper_refresh_from_fb(void)
{
    const uint8_t *black = fb_get_black_plane();
    const uint8_t *red = fb_get_red_plane();
    uint8_t fmt = fb_get_format();

    if (!black) {
        LOG_ERR("No framebuffer data");
        return -1;
    }

    if (fmt == FORMAT_2PLANE && red) {
        LOG_INF("Refreshing BWR display");
        return epaper_refresh_bwr(black, red);
    } else {
        LOG_INF("Refreshing BW display");
        return epaper_refresh_bw(black);
    }
}