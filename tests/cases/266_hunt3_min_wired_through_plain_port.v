module a(output wand o, input i);
  assign o = i;
endmodule
module b(output o, input i, input j);
  a u(o, i);
  a v(o, j);
endmodule
module t;
  wire [1:0] w;
  reg i, j;
  b x(w[0], i, j);
  initial begin i = 0; j = 1; #1 $display("%b", w); end
endmodule
