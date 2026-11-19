module t;
 parameter real Z = 0.0;
 parameter real NZ = -Z;
 parameter real C = $ceil(-0.5);
 initial begin
  $display("%f %f", NZ, C);
 end
endmodule
