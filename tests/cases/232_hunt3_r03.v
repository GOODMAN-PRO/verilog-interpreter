module t;
  reg [3:0] v;
  reg [$bits(v)-1:0] w;
  initial $display("%0d", $bits(w));
endmodule
