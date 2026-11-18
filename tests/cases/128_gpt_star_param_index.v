module top;
  localparam [1:0] P=2'b10;
  reg i, q;
  always @* q=P[i];
  initial begin #1 i=1; #1 $display("%b",q); end
endmodule
