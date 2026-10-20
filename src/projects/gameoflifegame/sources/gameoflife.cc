// Written by Caleb LaFeve 
//Conway's game of life
//modified for raspberrypi


//Rules
//    Any live cell with fewer than two live neighbors dies, as if by underpopulation.
//    Any live cell with two or three live neighbors lives on to the next generation.
//    Any live cell with more than three live neighbors dies, as if by overpopulation.
//    Any dead cell with exactly three live neighbors becomes a live cell, as if by reproduction.

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
#include <random>


using namespace std;

#define CLK  8   // USE THIS ON ARDUINO UNO, ADAFRUIT METRO M0, etc.
//#define CLK A4 // USE THIS ON METRO M4 (not M0)
//#define CLK 11 // USE THIS ON ARDUINO MEGA
#define OE   9
#define LAT 10
#define A   A0
#define B   A1
#define C   A2
#define D   A3
#define crNum(x,y,z) ((x)+(y))%z
//Animation Speed

//How many loops before it checks if dead
#define resetTime 100

//Replace width, height, and both 2D arrays to the dimensions of your LED matrix
//I was working with a 32x32
#define WIDTH 32
#define HEIGHT 32



using rgb_matrix::GPIO;
using rgb_matrix::RGBMatrix;
using rgb_matrix::Canvas;


volatile bool interrupt_received = false;
static void InterruptHandler(int signo) 
{
    syslog( LOG_NOTICE, "interrupt handler ");
    interrupt_received = true;
}


Canvas *canvas;
int r, g, b;
int counter = 0;
int cells[HEIGHT][WIDTH];
int newCells[HEIGHT][WIDTH];
int age[HEIGHT][WIDTH];
int sum1 = 0;
int animationSpeed=75;

// forward delarations
void setup();
void loop();
int  checkSum();
void reset();
void update();
void writeNextGeneration();

int main(int argc, char *argv[])
{
	srand (time(NULL));
	setlogmask (LOG_UPTO (LOG_NOTICE));
	openlog ("gameoflife", LOG_CONS | LOG_PID | LOG_NDELAY, LOG_LOCAL1);

	animationSpeed = rand() % 150 + 30;
	cout << "speed " << animationSpeed << endl;

	int maxtime = 0;
	if ( argc > 1 )
	{
	    string test(argv[1]);
	    syslog( LOG_NOTICE, "running for %s seconds then quitting\n", test.c_str());
	    maxtime = std::stoi( test );
	 }

	syslog( LOG_NOTICE, "gameoflife started pid: %d", getuid());
	GPIO io;
	if (!io.Init())
		return 1;
	std::string font_type = "./pongnumberfont.bdf";
	rgb_matrix::Font font;
        if (!font.LoadFont(font_type.c_str()))
        {
            cout <<  "Couldn't load font " << font_type << std::endl;
            return 1;
        }

	signal(SIGTERM, InterruptHandler);
	signal(SIGINT, InterruptHandler);


        canvas = new RGBMatrix(&io, 32, 1);
	bool cont = true;

	time_t t = time(0);
        time_t startTime = time(0);

	setup();
	while( cont )
	{
	    t = time(0);
            loop();
            if (maxtime > 0 )
	    {
	        if( difftime(t,startTime) > maxtime)
	        {
	          cont=false;
                  printf("stopping now\n");
                }
            } 
	   if (interrupt_received )
	   {
		   cont = false;
	   }
       }
       canvas->Clear();
       delete canvas;
}


void setup() {
  //Color 
  r = 100;
  g = 100;
  b = 100;

  //Create dead/alive cells
  //0 == Dead
  //1 == Alive

  for(unsigned int row = 0; row < WIDTH; row++)
  { 
      for(unsigned int col = 0; col < HEIGHT; col++)
      {
	      cells[row][col] = rand()%2;
	      age[row][col] = 0;
      }
  }
}

void loop() {
  
  counter++;
  
  if(counter % resetTime == 0){
    sum1 = checkSum();
    
  }
  if(counter % resetTime == 1){
    if(checkSum() == sum1){
      reset();
      counter = 0;
    }
    sum1 = 0;
  }//Just in case it still gets stuck
  //10000 at 75 ms delay between frames is about 20 minutes
  if(counter == 10000){
    reset();
    counter = 0;
    sum1=0;
  }
  
  update();
  usleep(1000*animationSpeed);
  writeNextGeneration();
  

}
int checkSum(){
  int sum = 0;
  for(unsigned int row = 0; row < WIDTH; row++) for(unsigned int col = 0; col < HEIGHT; cells[row][col++]) sum += cells[row][col];
  return sum;
}
//Resets 2D araay back to randomness
void reset()
{
  for(unsigned int row = 0; row < WIDTH; row++) for(unsigned int col = 0; col < HEIGHT; cells[row][col++] = rand()%2);
  counter=0;
}
//This method checks every cell(pixel) and check to see how many neighbors it has
//The amount of neighbors determines its future state
void writeNextGeneration(){
  for(int row = 0; row < WIDTH; row++){
    for(int col = 0; col < HEIGHT; col++){
      newCells[row][col] = cells[row][col];
    }
  }
  
  for(unsigned int row = 0; row < WIDTH; row++){
    for(unsigned int col = 0; col < HEIGHT; col++){
      int surroundingCells = 0;
     
      bool isAlive=false;

      cells[row][col]?isAlive = true:isAlive = false;
      
      for(int i = -1; i < 2; i++) for(int j = -1; j < 2; j++) surroundingCells += cells[crNum(row,i,WIDTH)][crNum(col,j,HEIGHT)];
      
      surroundingCells -= cells[row][col];
      //Check neighboring cells and store its future state in a new 2D array
      if((surroundingCells < 2 || surroundingCells > 3) && isAlive) newCells[row][col] = 0;
 
      if(surroundingCells == 3 && !isAlive) newCells[row][col] = 1;
      
    }
  }
  //copy new 2d Array to old
  for(int row = 0; row < WIDTH; row++) for(int col = 0; col < HEIGHT; col++)
  {
      // keep track of the age of this pixel
      if ( cells[row][col] == 1 && newCells[row][col] == 1 )
      {
    	age[row][col] = age[row][col] + 1;
	if ( age[row][col] > 255 )
		age[row][col] = 255;
      }
      else
	age[row][col] = 0;      
      cells[row][col] = newCells[row][col];
  }
  
}
//Update pixels
void update(){
  for(unsigned int row = 0; row < WIDTH; row++)
    for(unsigned int col = 0; col < HEIGHT; col++)
      if ( cells[row][col] )
      {
	      float brightness = 0.5;
	      float r = 0;
	      float g = 255;
	      float b = 255;
	      float rn = 255;
	      float gn = 102;
	      float bn = 0;

	      float tmp = (255-age[row][col])/255.0;
	      float rt = (r-rn)* tmp;
	      float gt = (g-gn)* tmp;
	      float bt = (b-bn)* tmp;

	      float rf = (r-rt)*brightness;
	      float gf = (g-gt)*brightness;
	      float bf = (b-bt)*brightness;
	     canvas->SetPixel(row,col, rf , gf, bf);
      }
      else
	     canvas->SetPixel(row,col,0,0,0); 

}
