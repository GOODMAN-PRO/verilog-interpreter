module top;
task automatic t(input n); if(n) t(0); else #3; endtask
initial begin t(1); #1 $display("ok"); end
initial #1 disable t;
endmodule
