cmake_minimum_required(VERSION 3.20.0)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(codex-epaper-quota)

target_sources(app PRIVATE
    src/main.c
    src/ble_service.c
    src/epaper.c
    src/epaper_driver_ssd1680.c
    src/framebuffer.c
    src/power.c
)

target_include_directories(app PRIVATE src)