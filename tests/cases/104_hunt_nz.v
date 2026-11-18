module t;
 real r, z;
 initial begin
  z = 0.0;
  r = z * -3.0; $display("%f %e %g", r, r, r);
 end
endmodule
