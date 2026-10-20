#include "led-matrix.h"
#include "graphics.h"

#include <unistd.h>
#include <ctime>
#include <deque>
#include <cmath>
#include <sys/time.h>
#include <stdlib.h>

using namespace std;
using rgb_matrix::GPIO;
using rgb_matrix::RGBMatrix;
using rgb_matrix::Canvas;

#define SCREEN_SIZE 32

struct Point {
    int x, y;
    Point(int x = 0, int y = 0) : x(x), y(y) {}
};

deque<Point> snake;
Point direction(1, 0);
Point apple(SCREEN_SIZE / 2, SCREEN_SIZE / 2);

// HSV to RGB utility for time color
static rgb_matrix::Color getColorFromHSV(float h, float s, float v)
{
    h = fmod(h, 1.0f) * 6.0f;
    int i = floor(h);
    float f = h - i;
    float p = v * (1 - s);
    float q = v * (1 - f * s);
    float t = v * (1 - (1 - f) * s);

    float r, g, b;
    switch (i % 6)
    {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    return rgb_matrix::Color(static_cast<uint8_t>(r * 255), static_cast<uint8_t>(g * 255), static_cast<uint8_t>(b * 255));
}

// Minimal signed toroidal delta on a SCREEN_SIZE wrap-around grid
static int toroidalDelta(int from, int to)
{
    return to - from; // no wrapping across edges
}

static Point wrappedNext(const Point &head, const Point &dir)
{
    Point next = head;
    next.x = next.x + dir.x;
    next.y = next.y + dir.y;
    return next;
}

static bool inBounds(const Point &p)
{
    return p.x >= 0 && p.x < SCREEN_SIZE && p.y >= 0 && p.y < SCREEN_SIZE;
}

static bool occupies(const Point &p)
{
    for (const Point &s : snake)
    {
        if (s.x == p.x && s.y == p.y)
        {
            return true;
        }
    }
    return false;
}

void updateSnake() {
    Point next = snake.front();
    next.x = next.x + direction.x;
    next.y = next.y + direction.y;
    if (!inBounds(next))
    {
        return; // do not move out of bounds
    }
    snake.push_front(next);
}

void moveApple() {
    apple.x = rand() % SCREEN_SIZE;
    apple.y = rand() % SCREEN_SIZE;
}

void moveTowardsApple()
{
    const Point head = snake.front();
    int dx = toroidalDelta(head.x, apple.x);
    int dy = toroidalDelta(head.y, apple.y);

    auto isReverse = [&](const Point &cand) -> bool
    {
        return (snake.size() > 1) && (cand.x == -direction.x) && (cand.y == -direction.y);
    };

    // Build candidates in order of preference: maintain axis, then larger distance axis, then the other
    Point cand_axes[4];
    int count = 0;

    if (direction.x != 0 && dx != 0)
    {
        cand_axes[count++] = Point(dx > 0 ? 1 : -1, 0);
    }
    if (direction.y != 0 && dy != 0)
    {
        cand_axes[count++] = Point(0, dy > 0 ? 1 : -1);
    }
    if (abs(dx) >= abs(dy))
    {
        if (dx != 0) cand_axes[count++] = Point(dx > 0 ? 1 : -1, 0);
        if (dy != 0) cand_axes[count++] = Point(0, dy > 0 ? 1 : -1);
    }
    else
    {
        if (dy != 0) cand_axes[count++] = Point(0, dy > 0 ? 1 : -1);
        if (dx != 0) cand_axes[count++] = Point(dx > 0 ? 1 : -1, 0);
    }
    // Always consider continuing straight as fallback
    if (count < 4)
    {
        cand_axes[count++] = direction;
    }

    // Try candidates, avoiding reverse and collisions
    for (int i = 0; i < count; ++i)
    {
        Point cand = cand_axes[i];
        if (isReverse(cand))
        {
            continue;
        }
        Point next = wrappedNext(head, cand);
        if (inBounds(next) && !occupies(next))
        {
            direction = cand;
            return;
        }
    }

    // As a last resort, try any non-reverse direction that doesn't collide
    const Point dirs[4] = { Point(1,0), Point(-1,0), Point(0,1), Point(0,-1) };
    for (const Point &cand : dirs)
    {
        if (isReverse(cand))
        {
            continue;
        }
        Point next = wrappedNext(head, cand);
        if (inBounds(next) && !occupies(next))
        {
            direction = cand;
            return;
        }
    }
    // If truly boxed in or at edge, stop moving
    direction = Point(0, 0);
}

int main(int argc, char *argv[]) {
    GPIO io;
    if (!io.Init())
        return 1;

    Canvas *canvas = new RGBMatrix(&io, SCREEN_SIZE, 1);

    // Load font for time display
    rgb_matrix::Font time_font;
    if (!time_font.LoadFont("pongnumberfont.bdf"))
    {
        fprintf(stderr, "Failed to load font: pongnumberfont.bdf\n");
    }

    rgb_matrix::Color snakeColor(0,80,0);
    rgb_matrix::Color appleColor(80,0,0);

    snake.push_back(Point(SCREEN_SIZE / 2, SCREEN_SIZE / 2));

    time_t t = time(0);
    //struct tm* now = localtime(&t);
    time_t startTime = time(0);

    int maxtime = 0;
    if ( argc > 1 )
    {
        string test(argv[1]);
        maxtime = std::stoi( test );
    }

    srand(time(0)); 

    bool cont = true;
    while (cont) 
    {
       // high-resolution time for color animation
       struct timeval tv; gettimeofday(&tv, NULL);
       double current_time = tv.tv_sec + tv.tv_usec / 1e6;
       t = time(0);
       //now = localtime(&t);
       if (snake.front().x == apple.x && snake.front().y == apple.y) {
            moveApple();
        } else {
            snake.pop_back();
        }
							        
        moveTowardsApple();
        updateSnake();

        canvas->Fill(0, 0, 0);

        // Draw current time (HH:MM:SS) top-right, color cycling between green, white, and red
        {
            struct tm tm_now;
            localtime_r(&t, &tm_now);
            char time_str[9];
            strftime(time_str, sizeof(time_str), "%H:%M:%S", &tm_now);

            // Hue oscillates between red (0.0/1.0) and green (~0.333) and saturation cycles to include white
            const float cycle_period = 12.0f; // seconds for full red->green->red cycle
            float phase = static_cast<float>(fmod(current_time, cycle_period) / cycle_period); // 0..1
            float hue_center = 1.0f / 6.0f;    // midway between red (0) and green (~1/3) → ~0.1667 (yellow-green)
            float hue_amp    = 1.0f / 6.0f;    // swing ±0.1667 to cover 0..0.333
            float hue_time   = hue_center + hue_amp * sinf(2.0f * M_PI * phase);
            if (hue_time < 0.0f) hue_time += 1.0f; // wrap
            if (hue_time >= 1.0f) hue_time -= 1.0f;
            float sat_time   = 0.5f + 0.5f * cosf(2.0f * M_PI * phase); // 1→0→1 to pass through white
            rgb_matrix::Color time_color = getColorFromHSV(hue_time, sat_time, 0.4f); // 40% brightness

            int letter_spacing = 0;
            int baseline = time_font.baseline();

            int measure_start_x = 0;
            int end_x = rgb_matrix::DrawText(canvas, time_font, measure_start_x, -100, time_color, NULL, time_str, letter_spacing);
            int text_width = end_x - measure_start_x;
            int start_x = SCREEN_SIZE - text_width - 3; // align with droplet placement
            if (start_x < 0)
            {
                start_x = 0;
            }

            rgb_matrix::DrawText(canvas, time_font, start_x, baseline, time_color, NULL, time_str, letter_spacing);
        }

        // Draw apple and snake after time so they appear on top
        canvas->SetPixel(apple.x, apple.y, appleColor.r, appleColor.g, appleColor.b);

        for (Point &p : snake)
            canvas->SetPixel(p.x, p.y, snakeColor.r, snakeColor.g, snakeColor.b);

        usleep(200000);
	if (maxtime > 0 )
        {
            if( difftime(t,startTime) > maxtime)
            {
                cont=false;
                printf("stopping now\n");
            }
        }
    }

   canvas->Clear();
   delete canvas;
   return 0;
}
