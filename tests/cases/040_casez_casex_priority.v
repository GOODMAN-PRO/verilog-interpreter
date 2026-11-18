module tb;
  task check;
    input [3:0] value;
    integer z_result, x_result;
    begin
      casez (value)
        4'b1???: z_result = 4;
        4'b01??: z_result = 3;
        4'b001?: z_result = 2;
        4'b0001: z_result = 1;
        default: z_result = 0;
      endcase
      casex (value)
        4'b1xxx: x_result = 4;
        4'b01xx: x_result = 3;
        4'b001x: x_result = 2;
        4'b0001: x_result = 1;
        default: x_result = 0;
      endcase
      $display("value=%b casez=%0d casex=%0d", value, z_result, x_result);
    end
  endtask
  initial begin
    check(4'b0000);
    check(4'b0011);
    check(4'b1010);
    check(4'b0z01);
    check(4'b0x01);
    check(4'bz000);
    check(4'bx000);
    $finish;
  end
endmodule