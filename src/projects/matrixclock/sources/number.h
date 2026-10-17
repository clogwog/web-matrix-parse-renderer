#ifndef NUMBER_HPP
#define NUMBER_HPP




class Number
{
	public:
	    Number(int x, int y);
	    bool hittest(int x, int y);
	    void update(int num);
											                        

        private:
	    int num;
	    int  x;
	    int  y;
};   

#endif // NUMBER_HPP
