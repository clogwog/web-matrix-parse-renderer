#include "led-matrix.h"
#include "graphics.h"

#include <unistd.h>
#include <math.h>
#include <stdio.h>
#include <functional>
#include <cstdlib>
#include <iostream>
#include <cstring>
#include <ctime>
#include <signal.h>
#include <syslog.h>
#include <sys/time.h>
#include <cstdint>

using namespace std;

using rgb_matrix::GPIO;
using rgb_matrix::RGBMatrix;
using rgb_matrix::Canvas;


typedef uint8_t byte;

#define SCREEN_SIZE 32
#define pi M_PI

int main(int argc, char *argv[]) 
{
  setlogmask( LOG_UPTO (LOG_NOTICE));
  GPIO io;
  if (!io.Init())
    return 1;

   int maxtime = 0;
   if ( argc > 1 )
   {
       string test(argv[1]);
       syslog( LOG_NOTICE, "running for %s seconds then quitting\n", test.c_str());
       maxtime = std::stoi( test );
   }


  std::string font_type = "./10x20.bdf";
  rgb_matrix::Font font;
  if (!font.LoadFont(font_type.c_str())) 
  {
	cout <<  "Couldn't load font " << font_type << std::endl;
        return 1;
  }

  Canvas *canvas = new RGBMatrix(&io, SCREEN_SIZE, 1);

  rgb_matrix::Color offColor(0,0,0);


   int x,y;
   double sec = 0.0;
   double dx,dy,dv;
   time_t t;
   struct tm* now = localtime(&t);
   time_t startTime = time(0);


  bool cont = true;
  double brightness = 0.5;

  while(cont)
  {
        t = time(0);
        now = localtime(&t);
        std::string strHour = std::to_string(now->tm_hour);
        if( strHour.length() == 1) strHour.insert(0, 1, '0');
        std::string strMinute = std::to_string(now->tm_min);
       if( strMinute.length() == 1) strMinute.insert(0,1,'0');

	sec = sec + 0.001;
	for(x=0;x<SCREEN_SIZE;x++)
	{
		for(y=0;y<SCREEN_SIZE;y++)
		{
			dx = x + .5 * sin(sec/5.0);
			dy = y + .5 * cos(sec/3.0);
			dv = sin(x*10 + sec) + sin(10*(x*sin(sec/2.0) + y*cos(sec/3.0)) + sec) + sin(sqrt(100*(dx*dx + dy*dy)+1) + sec);
			int r = 255 * fabs(sin( dv*pi       / 8)) 		* brightness;
			int g = 255 * fabs(sin( dv*pi + 2*pi/6)) 	* brightness;
			int b = 255 * fabs(sin( dv*pi + 4*pi/4)) 	* brightness;
			canvas->SetPixel(x, y, r , g  , b);
		}
                rgb_matrix::DrawText(canvas, font, 0,14 , offColor, strHour.c_str());
                rgb_matrix::DrawText(canvas, font, 12, 30, offColor, strMinute.c_str());
	}


      if (maxtime > 0 )
      {
          if( difftime(t,startTime) > maxtime)
          {
              cont=false;
              printf("stopping now\n");
          }
      }
      usleep(100000);
  }


  canvas->Clear();
  delete canvas;
  return 0;
}

