module t; real r;
initial begin r = 1.0e-7;
$display("[%.17g]", r);
$display("[%.16e]", r);
end endmodule
