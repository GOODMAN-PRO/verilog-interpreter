module tb;
  reg [3:0] value;
  integer branch;
  task check;
    input [3:0] test_value;
    begin
      value = test_value;
      if (value) branch = 1;
      else branch = 0;
      $write("value=%b if=%0d case=", value, branch);
      case (value)
        4'b0000: $display("zero");
        4'b0010, 4'b0011: $display("two-or-three");
        4'bx000: $display("exact-x");
        4'bz000: $display("exact-z");
        default: $display("other");
      endcase
    end
  endtask
  initial begin
    check(4'b0000);
    check(4'b0010);
    check(4'b0011);
    check(4'bx000);
    check(4'bz000);
    check(4'bx001);
    $finish;
  end
endmodule