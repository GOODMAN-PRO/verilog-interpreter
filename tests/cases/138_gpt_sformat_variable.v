module top;
  reg [23:0] fmt, out;
  initial begin
    fmt="%0h";
    $sformat(out,fmt,15);
    $display("[%0s]",out);
  end
endmodule
