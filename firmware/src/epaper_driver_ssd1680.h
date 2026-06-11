#ifndef EPAPER_DRIVER_SSD1680_H_
#define EPAPER_DRIVER_SSD1680_H_

#include <stdint.h>

int ssd1680_init(void);
int ssd1680_sleep(void);
int ssd1680_clear(void);
int ssd1680_refresh_bw(const uint8_t *black);
int ssd1680_refresh_bwr(const uint8_t *black, const uint8_t *red);

#endif /* EPAPER_DRIVER_SSD1680_H_ */