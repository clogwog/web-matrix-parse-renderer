#pragma once
static const int LOG_NOTICE = 5;
static const int LOG_CONS = 2;
static const int LOG_PID = 1;
static const int LOG_NDELAY = 8;
static const int LOG_LOCAL1 = 128;
static int LOG_UPTO(int pri)
{
    return pri;
}
