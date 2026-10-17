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
#include <memory>
#include "number.h"

using namespace std;

using rgb_matrix::GPIO;
using rgb_matrix::RGBMatrix;
using rgb_matrix::Canvas;


volatile bool interrupt_received = false;
static void InterruptHandler(int signo) {
	 syslog( LOG_NOTICE, "interrupt handler ");
	  interrupt_received = true;
}

//forward declaration
void DrawGreenPixelPercentage(Canvas* canvas, int x, int y , float percentage);
void DrawWhitePixelPercentage(Canvas* canvas, int x, int y , float percentage);

static Number g_hour_ten(0,9);
static Number g_hour_one(8,9);
static Number g_minute_ten(17,9);
static Number g_minute_one(25,9);


class Rune
{
	public:
		Rune(Canvas* canvas, int col)
		{
			this->canvas = canvas;
			this->x      = col;
			y = 0.0;

			height = rand_FloatRange(3.0,15.0);
			speed = rand_FloatRange(0.1,0.5);
			done = false;
			for(int t=0;t<32;t++)
			{
				localstrength[t] = rand() % 40 + 50;
			}
		}
		void update_location()
		{
			y = y + speed;
			if ( y - height > 32 )
				done = true;
		}

		void render()
		{
			if( y <= height)
			{
				int led=0;
				for( led=0; led <= y; led++)
				{
				  DrawGreenPixelPercentage(canvas,x,led,localstrength[led]);
				}
				DrawWhitePixelPercentage(canvas,x,led,localstrength[led]);

			}
			else
			{
				int led;
				for( led = y - height ; led < y ; led++)
				{
					DrawGreenPixelPercentage(canvas,x,led,localstrength[led]);
				}
				DrawWhitePixelPercentage(canvas,x,led,localstrength[led]);

				// clear tail end
				canvas->SetPixel(x,y-height-1,0,0,0);
			}			
		}

		
		Canvas* canvas;
		float y;
		int x;
		float height; 
		float speed;
		bool  done;
		int   localstrength[32];


	private:
		float rand_FloatRange(float a, float b)
		{
			    return ((b - a) * ((float)rand() / RAND_MAX)) + a;
		}

};



void DrawWhitePixelPercentage(Canvas* canvas, int x, int y , float percentage)
{
        // white to black 
        float r = 170;
        float g = 170;
        float b = 170;
        float rn = 0;
        float gn = 0;
        float bn = 0;

        float strength = (percentage/100.0);
        float rt = (r-rn)* strength;
        float gt = (g-gn)* strength;
        float bt = (b-bn)* strength;

        float rf = r-rt;
        float gf = g-gt;
        float bf = b-bt;
        canvas->SetPixel(x,y, rf , gf, bf);
}


void DrawGreenPixelPercentage(Canvas* canvas, int x, int y , float percentage)
{
	// green black to black	
	float r = 70;
	float g = 170;
	float b = 24;
	float rn = 0;
	float gn = 0;
	float bn = 0;    

	float strength = (percentage/100.0);
	float rt = (r-rn)* strength;
	float gt = (g-gn)* strength;
	float bt = (b-bn)* strength;

	float rf = r-rt;
	float gf = g-gt;
	float bf = b-bt;

	if ( g_hour_ten.hittest(x,y) ||
	     g_hour_one.hittest(x,y) ||
	     g_minute_ten.hittest(x,y) ||
	     g_minute_one.hittest(x,y)  )
		canvas->SetPixel(x,y,r,g,b);
	else
		canvas->SetPixel(x,y, rf , gf, bf);
}

int main(int argc, char *argv[]) 
{

  setlogmask (LOG_UPTO (LOG_NOTICE));
  openlog ("matrixlock", LOG_CONS | LOG_PID | LOG_NDELAY, LOG_LOCAL1);

  int maxtime = 0;
  if ( argc > 1 )
  {
     string test(argv[1]);
     syslog( LOG_NOTICE, "running for %s seconds then quitting\n", test.c_str());
     maxtime = std::stoi( test );
  }

  //syslog( LOG_NOTICE, "Pongclock started pid: %d", getuid());
  GPIO io;
  if (!io.Init())
    return 1;

  srand((unsigned int)time(NULL));

  std::string font_type = "./pongnumberfont.bdf";
  rgb_matrix::Font font;
  if (!font.LoadFont(font_type.c_str())) 
  {
	cout <<  "Couldn't load font " << font_type << std::endl;
        return 1;
  }

  Canvas *canvas = new RGBMatrix(&io, 32, 1);

  signal(SIGTERM, InterruptHandler);
  signal(SIGINT, InterruptHandler);
	
  rgb_matrix::Color color(70, 170, 24);
  rgb_matrix::Color offColor(0,0,0);

 
  string oldMin = "";
  string oldHour = ""; 
 
  time_t t = time(0);
  struct tm* now = localtime(&t);

  oldHour = std::to_string(now->tm_hour);
  if( oldHour.length() == 1) oldHour.insert(0, 1, '0');
  oldMin = std::to_string(now->tm_min); 
  if( oldMin.length() == 1) oldMin.insert(0,1,'0');
  
  
  bool cont = true;
  time_t startTime = time(0);

  vector<shared_ptr<Rune>> runes[32];

  int onceEvery15 = 15; 
  while(cont)
  {
	// draw time
	t = time(0);
	now = localtime(&t);

	timeval tv;
	gettimeofday(&tv, NULL);


	if (maxtime > 0 )
	{
	    if( difftime(t,startTime) > maxtime)
	    {
		cont=false;
		printf("stopping now\n");
	    }
	}
	for( int t=0; t<32;t++)
	{
	   bool foundOne = false;
	   int location = -1;
	   for(auto & elem : runes[t])
	   {
		location++;
		if( elem->done)
		{
			foundOne = true;
		}
	   }
	   if( foundOne)
	   {
		runes[t].erase (runes[t].begin()+location);
	   }

	}

	for( int t=0; t<32;t++)
	{

	   if( runes[t].size() < 4 && t == rand() % 64 )
	   {
	      auto newRune = make_shared<Rune>(canvas,t);
	      runes[t].push_back(newRune);
	   }
	}

	// update location
	for( int t=0; t<32;t++)
	{
		for(auto & elem : runes[t])
	        {
		   elem->update_location();
		   elem->render();
		}			        
	}

	onceEvery15--;
	if( onceEvery15 <= 0 )
	{
		g_hour_ten.update(now->tm_hour / 10);
		g_hour_one.update(now->tm_hour % 10);
		g_minute_ten.update( now->tm_min / 10);
		g_minute_one.update( now->tm_min % 10);
		onceEvery15=15;
	}


	// wait a bit
	usleep(25000);
	if ( interrupt_received )
		cont = false;
  }

  syslog(LOG_NOTICE, "end of pongclock,natural end");

  canvas->Clear();
  delete canvas;
  return 0;
}

