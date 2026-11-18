module top;
reg a,q;
always @* wait(a) q=1;
initial begin #1 a=1; #1 $display("%b",q); end
endmodule
