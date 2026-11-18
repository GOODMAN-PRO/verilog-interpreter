module t;
 integer i; reg signed [7:0] s;
 initial begin i=-5; s=-42;
  $display("[%05d] [%08d] [%03d]", i, i, s);
 end
endmodule
