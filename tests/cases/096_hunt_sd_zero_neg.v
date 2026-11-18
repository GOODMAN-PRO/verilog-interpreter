module t;
integer i;
initial begin i=-42; $display("%05d|%010d", i, i); end
endmodule
