module top;
  initial $display("%h", $realtobits($ceil($bitstoreal(64'h8000000000000000))));
endmodule
