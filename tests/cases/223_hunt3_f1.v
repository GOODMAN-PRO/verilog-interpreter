module ch(output o); assign o = 1'bz; pullup(o); endmodule
module t;
  wire w; ch c(w); reg r; assign w = r;
  initial begin r=1'b0; #1 $display("%b",w); r=1'bz; #1 $display("%b",w); end
endmodule
