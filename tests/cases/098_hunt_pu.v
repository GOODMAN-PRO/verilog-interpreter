module t; wire w; reg e=0;
 pullup (w);
 initial begin #1 $display("%b",w); end
endmodule
