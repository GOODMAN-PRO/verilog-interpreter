module t;
real r;
initial begin
  r = 1.5;
  $display("[%100000d]", 1);
  $display("[%.500f]", r);
  $display("[%.5000e]", r);
  $display("[%3000.2g]", r);
  $display("[%99999999999d]", 1);
end
endmodule
