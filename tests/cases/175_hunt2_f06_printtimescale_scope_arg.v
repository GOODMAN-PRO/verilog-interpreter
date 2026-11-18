`timescale 1ns/1ps
module sub;
endmodule
`timescale 1us/1ns
module t;
  sub s();
  initial $printtimescale(s);
endmodule
