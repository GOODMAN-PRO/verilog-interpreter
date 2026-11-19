module ch(output wor o, input d); assign o = d; endmodule
module t;
  wire w; reg a,b;
  ch c1(w,a); ch c2(w,b);
  initial begin a=0;b=1;#1 $display("%b",w); end
endmodule
