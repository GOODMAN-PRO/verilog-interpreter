module top;
integer s; initial begin s=12345; $display("%0d",$dist_uniform(s,32'hfffffff9,2)); $display("%0d",s); end
endmodule
