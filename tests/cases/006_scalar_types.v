module tb;
  reg flag;
  reg signed [7:0] signed_byte;
  wire [7:0] mirror = signed_byte;
  integer count;
  time timestamp;
  real fraction;
  initial begin
    $display("initial %b %b %h %h %0.1f", flag, signed_byte, count, timestamp, fraction);
    flag = 1;
    signed_byte = -7;
    count = -123456;
    timestamp = 64'h00000002_00000003;
    fraction = 1.25;
    #1;
    $display("values %b %0d %h %0d %h %0.2f", flag, signed_byte, mirror, count, timestamp, fraction);
    $display("bits %0d %0d %0d %0d %0d", $bits(flag), $bits(signed_byte), $bits(count), $bits(timestamp), $bits(fraction));
    $finish;
  end
endmodule
