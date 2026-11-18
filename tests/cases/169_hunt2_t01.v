module m(inout [1:0] a, input e); assign a = e ? 2'b10 : 2'bz; endmodule
module t; wire x,y; reg e=0; m u({x,y}, e); initial begin #1 $display("%b%b",x,y); e=1; #1 $display("%b%b",x,y); end endmodule
