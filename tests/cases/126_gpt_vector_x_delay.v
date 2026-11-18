module top;
  reg [1:0] a;
  wire [1:0] q;
  assign #(7,2,3) q=a;
  initial begin a=0; #10 a=2'b1x; #4 $display("%b",q); end
endmodule
