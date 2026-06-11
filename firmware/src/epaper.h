#ifndef EPAPER_H_
#define EPAPER_H_

#include <stdint.h>

int epaper_init(void);
int epaper_sleep(void);
int epaper_clear(void);
int epaper_refresh_bw(const uint8_t *black);
int epaper_refresh_bwr(const uint8_t *black, const uint8_t *red);
int epaper_refresh_from_fb(void);

#endif /* EPAPER_H_ */