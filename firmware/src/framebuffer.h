#ifndef FRAMEBUFFER_H_
#define FRAMEBUFFER_H_

#include <stdint.h>

int fb_begin_frame(uint16_t width, uint16_t height, uint8_t format,
                   uint32_t frame_size, uint32_t crc32, uint16_t chunk_size);
int fb_write_chunk(uint16_t seq, const uint8_t *data, uint16_t len);
int fb_end_frame(void);
void fb_abort(void);

const uint8_t *fb_get_black_plane(void);
const uint8_t *fb_get_red_plane(void);
uint16_t fb_get_width(void);
uint16_t fb_get_height(void);
uint8_t fb_get_format(void);

#endif /* FRAMEBUFFER_H_ */