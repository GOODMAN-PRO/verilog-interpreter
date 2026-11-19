module t;
  generate if (1) begin : g
    reg x;
    initial x = 0;
  end endgenerate
  assign x = 1;
  initial #1 $display("%b %b", x, g.x);
endmodule
