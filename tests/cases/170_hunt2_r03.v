module t; reg a=1'bz; wire #5 w = ~a; wire [1:0] v; assign #3 v[0]=a; initial begin #1 $display("%b %b",w,v); #7 $display("%b %b",w,v); end endmodule
