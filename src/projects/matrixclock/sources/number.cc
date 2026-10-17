#include "number.h"
#include <stdio.h>

#define NW 8
#define NH 16

#define __ false
#define XX true

static bool one[NH][NW] = {
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__,
__,__,__,XX,XX,__,__,__
};

static bool two[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};

static bool three[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__ 
};


static bool four[NH][NW] = {
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__
};

static bool five[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};

static bool six[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,__,__,__,__,__,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};

static bool seven[NH][NW] =  {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__
};

static bool eight[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};

static bool nine[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
__,__,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};

static bool zero[NH][NW] = {
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,__,__,__,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__,
XX,XX,XX,XX,XX,XX,XX,__
};


Number::Number(int x, int y) 
{
	this->num = 0;
	this->x = x;
	this->y = y;
	printf( "in number %d  %d\n",x,y);
}

void
Number::update(int num)
{
	this->num = num % 10;
}

bool
Number::hittest(int globalx, int globaly)
{

    int localx = globalx - x;
    int localy = globaly - y;

    if (localx >= 8 || localy >= 16  || localx < 0 || localy < 0)
	    return false;
    switch ( num)
    {
	case 1:
	return one[localy][localx];
	case 2:
	return two[localy][localx];
    	case 3:
        return three[localy][localx];
	case 4:
	return four[localy][localx];
	case 5:
	return five[localy][localx];
	case 6:
	return six[localy][localx];
	case 7:
	return seven[localy][localx];
	case 8:
	return eight[localy][localx];
	case 9:
	return nine[localy][localx];
	case 0:
	return zero[localy][localx];
    }

    return false;
}


