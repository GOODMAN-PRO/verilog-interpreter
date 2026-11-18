module tb;
  function integer address_width;
    input integer depth;
    integer remainder;
    begin
      address_width = 0;
      remainder = depth - 1;
      while (remainder > 0) begin
        address_width = address_width + 1;
        remainder = remainder >> 1;
      end
    end
  endfunction
  function [7:0] reverse_byte(input [7:0] value);
    integer bit_number;
    begin
      for (bit_number = 0; bit_number < 8; bit_number = bit_number + 1)
        reverse_byte[bit_number] = value[7 - bit_number];
    end
  endfunction
  parameter DEPTH = 19;
  localparam WIDTH = address_width(DEPTH);
  localparam [7:0] REVERSED = reverse_byte(8'hb2);
  reg [WIDTH-1:0] address;
  initial begin
    address = DEPTH - 1;
    $display("depth=%0d width=%0d address=%b reversed=%h", DEPTH, WIDTH, address, REVERSED);
    $display("widths=%0d,%0d,%0d", address_width(1), address_width(8), address_width(9));
    $finish;
  end
endmodule