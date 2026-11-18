module t;
real r;
initial begin
  r = 2.5;
  $display("[%+010.1f][%+08.2e][%+010g]", r, r, r);
end
endmodule
