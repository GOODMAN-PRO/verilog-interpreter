module t; real r; initial begin r = 1e21; $display("%f", r); $display("%.2f", 2.0 ** 80); $display("%10.1f|", 1e25); end endmodule
