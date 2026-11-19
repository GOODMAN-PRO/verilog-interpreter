module m(output wor o, input a); assign o = a; endmodule
module m4(output wor [3:0] o, input [3:0] a); assign o = a; endmodule
module t;
  wire [3:0] y; wire s;
  m4 u1(y[3:0], 4'b0011); assign y = 4'b1000;
  m u2(s, 1'b0); assign s = 1'b1;
  wire [0:0] v; m u3(v[0], 1'b0); assign v = 1'b1;
  initial #1 $display("%b %b %b", y, s, v);
endmodule
