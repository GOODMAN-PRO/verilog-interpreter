module top;
  tri0 p;
  tri1 q;
  wand a;
  wor b;
  assign a=0, a=1, b=0, b=1;
  initial #1 $display("%b%b%b%b",p,q,a,b);
endmodule
