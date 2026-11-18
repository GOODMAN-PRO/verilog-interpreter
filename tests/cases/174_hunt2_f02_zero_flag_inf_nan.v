module t;
real z, r;
initial begin
  z = 0.0;
  r = 1.0/z;
  $display("[%010f][%010g][%010e]", r, -r, z/z);
end
endmodule
