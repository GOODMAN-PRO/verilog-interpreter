`timescale 1ns/1ps
module tb;
  reg [7:0] q;
  initial begin
    q=1;
    #1;
    q<=8'd10;
    $display("active=%0d",q);
    $strobe("strobe=%0d",q);
    #1;
    q<=8'hb3;
    $strobeb("binary:",q);
    #1;
    q<=8'hc4;
    $strobeh("hex:",q);
    #1;
    q<=8'd63;
    $strobeo("octal:",q);
    #1 $display("final=%0d",q);
    $finish;
  end
endmodule
