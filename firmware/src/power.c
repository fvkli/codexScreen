#include "power.h"

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(power, CONFIG_LOG_DEFAULT_LEVEL);

void power_init(void)
{
    LOG_INF("Power management initialized");
}

void power_idle(void)
{
    k_cpu_idle();
}

void power_deep_sleep(void)
{
    LOG_INF("Entering deep sleep");
    k_cpu_idle();
}