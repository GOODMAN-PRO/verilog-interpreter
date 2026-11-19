module t;
  supply1 [3:0] s; reg [3:0] a;
  assign s = a;
  initial begin a=4'b0101; #1 $display("%b",s); end
endmodule
