module top;
integer hits;
task automatic t(input abort_it);
  begin : work
    if (abort_it) #2 disable work;
    else #4 hits=hits+1;
  end
endtask
initial begin hits=0; t(1); end
initial #1 t(0);
initial #6 $display("%0d",hits);
endmodule
