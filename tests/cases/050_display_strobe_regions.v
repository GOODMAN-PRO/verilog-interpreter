module tb;
  reg [3:0] value;
  initial begin
    value = 1;
    $display("active value=%0d time=%0d", value, $time);
    $strobe("strobe value=%0d time=%0d", value, $time);
    value <= 7;
    #0 $display("inactive value=%0d time=%0d", value, $time);
    #1 $display("next value=%0d time=%0d", value, $time);
    value = 9;
    $strobe("second strobe value=%0d time=%0d", value, $time);
    value <= 3;
    #0 value <= 5;
    #1 $display("ordered nba value=%0d time=%0d", value, $time);
    $finish;
  end
endmodule